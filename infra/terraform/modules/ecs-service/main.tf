locals {
  name_prefix = "${var.project_name}-${var.environment}-${var.component_name}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Component   = var.component_name
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/${var.project_name}/${var.environment}/${var.component_name}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "this" {
  family                   = "${local.name_prefix}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name      = var.component_name
      image     = var.image_uri
      essential = true

      portMappings = [
        {
          name          = var.component_name
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
          appProtocol   = "http"
        }
      ]

      environment = [
        for name in sort(keys(var.environment_variables)) : {
          name  = name
          value = var.environment_variables[name]
        }
      ]

      secrets = [
        for name in sort(keys(var.secret_variables)) : {
          name      = name
          valueFrom = var.secret_variables[name]
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.this.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = var.component_name
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "this" {
  name            = "${local.name_prefix}-service"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = var.deployment_strategy == "ROLLING" ? 100 : null
  deployment_maximum_percent         = var.deployment_strategy == "ROLLING" ? 200 : null
  health_check_grace_period_seconds  = var.target_group_arn == null ? null : 60

  deployment_controller {
    type = "ECS"
  }

  deployment_configuration {
    strategy             = var.deployment_strategy
    bake_time_in_minutes = var.deployment_strategy == "BLUE_GREEN" ? tostring(var.bake_time_in_minutes) : null
  }

  dynamic "alarms" {
    for_each = var.deployment_strategy == "BLUE_GREEN" && length(var.deployment_alarm_names) > 0 ? [1] : []

    content {
      alarm_names = var.deployment_alarm_names
      enable      = true
      rollback    = true
    }
  }

  dynamic "deployment_circuit_breaker" {
    for_each = var.deployment_strategy == "ROLLING" ? [1] : []

    content {
      enable   = true
      rollback = true
    }
  }

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = true
  }

  dynamic "load_balancer" {
    for_each = var.target_group_arn == null ? [] : [var.target_group_arn]

    content {
      target_group_arn = load_balancer.value
      container_name   = var.component_name
      container_port   = var.container_port

      dynamic "advanced_configuration" {
        for_each = var.deployment_strategy == "BLUE_GREEN" ? [1] : []

        content {
          alternate_target_group_arn = var.alternate_target_group_arn
          production_listener_rule   = var.production_listener_rule_arn
          test_listener_rule         = var.test_listener_rule_arn
          role_arn                   = var.ecs_infrastructure_role_arn
        }
      }
    }
  }

  dynamic "service_registries" {
    for_each = var.service_discovery_registry_arn == null ? [] : [var.service_discovery_registry_arn]

    content {
      registry_arn = service_registries.value
    }
  }

  tags = local.common_tags
}
