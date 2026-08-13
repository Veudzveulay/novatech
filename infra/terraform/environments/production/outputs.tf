output "vpc_id" {
  description = "Identifiant du VPC production."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Identifiants des subnets publics production."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Identifiants des subnets privés production."
  value       = module.network.private_subnet_ids
}

output "internet_gateway_id" {
  description = "Identifiant de l'Internet Gateway production."
  value       = module.network.internet_gateway_id
}

output "public_route_table_id" {
  description = "Identifiant de la table de routage publique production."
  value       = module.network.public_route_table_id
}

output "private_route_table_id" {
  description = "Identifiant de la table de routage privée production."
  value       = module.network.private_route_table_id
}

output "alb_security_group_id" {
  description = "Identifiant du Security Group ALB production."
  value       = module.security_groups.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "Identifiant du Security Group ECS production."
  value       = module.security_groups.ecs_security_group_id
}

output "database_security_group_id" {
  description = "Identifiant du Security Group PostgreSQL production."
  value       = module.security_groups.database_security_group_id
}

output "alb_arn" {
  description = "ARN de l'Application Load Balancer production."
  value       = module.alb.alb_arn
}

output "alb_dns_name" {
  description = "Nom DNS public de l'Application Load Balancer production."
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID Route 53 de l'Application Load Balancer production."
  value       = module.alb.alb_zone_id
}

output "http_listener_arn" {
  description = "ARN du listener HTTP production."
  value       = module.alb.http_listener_arn
}

output "frontend_target_group_arn" {
  description = "ARN du target group frontend blue production."
  value       = module.alb.frontend_target_group_arn
}

output "api_gateway_target_group_arn" {
  description = "ARN du target group API Gateway blue production."
  value       = module.alb.api_gateway_target_group_arn
}

output "frontend_target_group_arns" {
  description = "ARN blue et green des target groups frontend production."
  value       = module.alb.frontend_target_group_arns
}

output "api_gateway_target_group_arns" {
  description = "ARN blue et green des target groups API Gateway production."
  value       = module.alb.api_gateway_target_group_arns
}
