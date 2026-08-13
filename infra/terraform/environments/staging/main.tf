module "network" {
  source = "../../modules/network"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

module "security_groups" {
  source = "../../modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.network.vpc_id
}

module "alb" {
  source = "../../modules/alb"

  project_name          = var.project_name
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id
}

locals {
  components = {
    frontend = {
      port             = 80
      target_group_arn = module.alb.frontend_target_group_arn
    }
    api-gateway = {
      port             = 3000
      target_group_arn = module.alb.api_gateway_target_group_arn
    }
    auth = {
      port             = 3001
      target_group_arn = null
    }
    paie = {
      port             = 3002
      target_group_arn = null
    }
    conges = {
      port             = 3003
      target_group_arn = null
    }
    recrutement = {
      port             = 3004
      target_group_arn = null
    }
  }

  internal_components = {
    for name, component in local.components : name => component
    if !contains(["frontend", "api-gateway"], name)
  }

  service_discovery_namespace = "${var.environment}.${var.project_name}.local"

  base_environment_variables = {
    for name, component in local.components : name => {
      NODE_ENV = "production"
      PORT     = tostring(component.port)
    }
  }

  environment_variables = merge(local.base_environment_variables, {
    api-gateway = merge(local.base_environment_variables["api-gateway"], {
      AUTH_SERVICE_URL        = "http://auth.${local.service_discovery_namespace}:3001"
      PAIE_SERVICE_URL        = "http://paie.${local.service_discovery_namespace}:3002"
      CONGES_SERVICE_URL      = "http://conges.${local.service_discovery_namespace}:3003"
      RECRUTEMENT_SERVICE_URL = "http://recrutement.${local.service_discovery_namespace}:3004"
    })
  })

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_ecs_cluster" "this" {
  name = "${var.project_name}-${var.environment}-cluster"

  tags = local.common_tags
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_service_discovery_private_dns_namespace" "this" {
  name        = local.service_discovery_namespace
  description = "Decouverte privee des services ${var.environment}"
  vpc         = module.network.vpc_id

  tags = local.common_tags
}

resource "aws_service_discovery_service" "internal" {
  for_each = local.internal_components

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {}

  tags = merge(local.common_tags, { Component = each.key })
}

module "ecs_services" {
  source   = "../../modules/ecs-service"
  for_each = local.components

  project_name                   = var.project_name
  environment                    = var.environment
  component_name                 = each.key
  image_uri                      = var.image_uris[each.key]
  container_port                 = each.value.port
  cpu                            = 256
  memory                         = 512
  desired_count                  = 1
  aws_region                     = var.aws_region
  cluster_id                     = aws_ecs_cluster.this.id
  execution_role_arn             = aws_iam_role.ecs_task_execution.arn
  subnet_ids                     = module.network.public_subnet_ids
  security_group_ids             = [module.security_groups.ecs_security_group_id]
  environment_variables          = local.environment_variables[each.key]
  target_group_arn               = each.value.target_group_arn
  service_discovery_registry_arn = contains(keys(local.internal_components), each.key) ? aws_service_discovery_service.internal[each.key].arn : null

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution,
    module.alb
  ]
}
