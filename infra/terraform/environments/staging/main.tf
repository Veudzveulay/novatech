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
  certificate_arn       = var.certificate_arn
}

locals {
  components = {
    frontend = {
      port                         = 80
      target_group_arn             = module.alb.frontend_target_group_arns.blue
      alternate_target_group_arn   = module.alb.frontend_target_group_arns.green
      production_listener_rule_arn = module.alb.frontend_production_listener_rule_arn
      test_listener_rule_arn       = module.alb.frontend_test_listener_rule_arn
      deployment_strategy          = "BLUE_GREEN"
    }
    api-gateway = {
      port                         = 3000
      target_group_arn             = module.alb.api_gateway_target_group_arns.blue
      alternate_target_group_arn   = module.alb.api_gateway_target_group_arns.green
      production_listener_rule_arn = module.alb.api_gateway_production_listener_rule_arn
      test_listener_rule_arn       = module.alb.api_gateway_test_listener_rule_arn
      deployment_strategy          = "BLUE_GREEN"
    }
    auth = {
      port                = 3001
      target_group_arn    = null
      deployment_strategy = "ROLLING"
    }
    paie = {
      port                = 3002
      target_group_arn    = null
      deployment_strategy = "ROLLING"
    }
    conges = {
      port                = 3003
      target_group_arn    = null
      deployment_strategy = "ROLLING"
    }
    recrutement = {
      port                = 3004
      target_group_arn    = null
      deployment_strategy = "ROLLING"
    }
  }

  internal_components = {
    for name, component in local.components : name => component
    if !contains(["frontend", "api-gateway"], name)
  }

  database_components = toset(["auth", "paie", "conges", "recrutement"])

  app_secret_names = ["jwt-secret", "stripe-secret-key"]

  service_discovery_namespace = "${var.environment}.${var.project_name}.local"

  base_environment_variables = {
    for name, component in local.components : name => {
      NODE_ENV = "production"
      PORT     = tostring(component.port)
    }
  }

  environment_variables = merge(
    local.base_environment_variables,
    {
      for name in local.database_components : name => merge(local.base_environment_variables[name], {
        DB_HOST = module.database.db_address
        DB_PORT = tostring(module.database.db_port)
        DB_NAME = var.db_name
      })
    },
    {
      api-gateway = merge(local.base_environment_variables["api-gateway"], {
        AUTH_SERVICE_URL            = "http://auth.${local.service_discovery_namespace}:3001"
        PAIE_SERVICE_URL            = "http://paie.${local.service_discovery_namespace}:3002"
        CONGES_SERVICE_URL          = "http://conges.${local.service_discovery_namespace}:3003"
        RECRUTEMENT_SERVICE_URL     = "http://recrutement.${local.service_discovery_namespace}:3004"
        FEATURE_RECRUITMENT_ENABLED = tostring(var.feature_recruitment_enabled)
      })
    }
  )

  secret_variables = merge(
    { for name in keys(local.components) : name => {} },
    {
      for name in local.database_components : name => {
        DB_USER     = "${module.database.master_user_secret_arn}:username::"
        DB_PASSWORD = "${module.database.master_user_secret_arn}:password::"
      }
    },
    {
      api-gateway = { JWT_SECRET = module.secrets.secret_arns["jwt-secret"] }
      auth = merge({
        DB_USER     = "${module.database.master_user_secret_arn}:username::"
        DB_PASSWORD = "${module.database.master_user_secret_arn}:password::"
      }, { JWT_SECRET = module.secrets.secret_arns["jwt-secret"] })
      paie = merge({
        DB_USER     = "${module.database.master_user_secret_arn}:username::"
        DB_PASSWORD = "${module.database.master_user_secret_arn}:password::"
      }, { STRIPE_SECRET_KEY = module.secrets.secret_arns["stripe-secret-key"] })
    }
  )

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

resource "aws_iam_role" "ecs_infrastructure" {
  name = "${var.project_name}-${var.environment}-ecs-infrastructure"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_infrastructure_load_balancers" {
  role       = aws_iam_role.ecs_infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonECSInfrastructureRolePolicyForLoadBalancers"
}

module "secrets" {
  source = "../../modules/secrets"

  project_name = var.project_name
  environment  = var.environment
  secret_names = local.app_secret_names
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${var.project_name}-${var.environment}-ecs-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = concat(values(module.secrets.secret_arns), [module.database.master_user_secret_arn])
    }]
  })
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
  secret_variables               = local.secret_variables[each.key]
  target_group_arn               = each.value.target_group_arn
  deployment_strategy            = each.value.deployment_strategy
  bake_time_in_minutes           = each.value.deployment_strategy == "BLUE_GREEN" ? 5 : null
  alternate_target_group_arn     = try(each.value.alternate_target_group_arn, null)
  production_listener_rule_arn   = try(each.value.production_listener_rule_arn, null)
  test_listener_rule_arn         = try(each.value.test_listener_rule_arn, null)
  ecs_infrastructure_role_arn    = each.value.deployment_strategy == "BLUE_GREEN" ? aws_iam_role.ecs_infrastructure.arn : null
  deployment_alarm_names         = each.value.deployment_strategy == "BLUE_GREEN" ? module.alb.target_group_health_alarm_names[each.key] : []
  service_discovery_registry_arn = contains(keys(local.internal_components), each.key) ? aws_service_discovery_service.internal[each.key].arn : null

  depends_on = [
    aws_iam_role_policy_attachment.ecs_task_execution,
    aws_iam_role_policy.ecs_task_execution_secrets,
    aws_iam_role_policy_attachment.ecs_infrastructure_load_balancers,
    module.alb
  ]
}

module "database" {
  source = "../../modules/database"

  project_name               = var.project_name
  environment                = var.environment
  private_subnet_ids         = module.network.private_subnet_ids
  database_security_group_id = module.security_groups.database_security_group_id
  db_name                    = var.db_name
  db_username                = var.db_username
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  backup_retention_period    = var.db_backup_retention_period
  deletion_protection        = var.db_deletion_protection
  skip_final_snapshot        = var.db_skip_final_snapshot
}
