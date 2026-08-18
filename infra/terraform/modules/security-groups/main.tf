locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  internal_service_ports = {
    auth        = 3001
    paie        = 3002
    conges      = 3003
    recrutement = 3004
  }
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Controle les flux du futur Application Load Balancer"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-alb-sg" })
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Controle les flux des futures taches ECS"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-ecs-sg" })
}

resource "aws_security_group" "database" {
  name        = "${local.name_prefix}-db-sg"
  description = "Limite PostgreSQL aux futures taches ECS"
  vpc_id      = var.vpc_id

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db-sg" })
}

# HTTP public temporaire pour le workshop. HTTPS attend la confirmation TLS.
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP public vers le futur ALB"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  tags              = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS public vers le futur ALB"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  tags              = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB vers le frontend ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "alb_to_api_gateway" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB vers l API Gateway ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "ecs_frontend_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "Frontend accessible uniquement depuis l ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "ecs_api_gateway_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "API Gateway accessible uniquement depuis l ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "ecs_internal_services" {
  for_each = local.internal_service_ports

  security_group_id            = aws_security_group.ecs.id
  description                  = "Communication ECS interne vers ${each.key}"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = each.value
  to_port                      = each.value
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

# Les tâches ECS nécessitent un accès sortant public pour les appels externes et
# les téléchargements de dépendances ; le trafic entrant reste strictement limité.
resource "aws_vpc_security_group_egress_rule" "ecs_http_ipv4" {
  security_group_id = aws_security_group.ecs.id
  description       = "Egress HTTP vers Internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  tags              = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "ecs_https_ipv4" {
  security_group_id = aws_security_group.ecs.id
  description       = "Egress HTTPS vers Internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  tags              = local.common_tags
}

resource "aws_vpc_security_group_egress_rule" "ecs_db_ipv4" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "Egress vers PostgreSQL"
  referenced_security_group_id = aws_security_group.database.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}

resource "aws_vpc_security_group_ingress_rule" "database_postgresql_from_ecs" {
  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL accessible uniquement depuis ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  tags                         = local.common_tags
}
