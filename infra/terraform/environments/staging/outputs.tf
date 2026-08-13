output "vpc_id" {
  description = "Identifiant du VPC staging."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "Identifiants des subnets publics staging."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Identifiants des subnets privés staging."
  value       = module.network.private_subnet_ids
}

output "internet_gateway_id" {
  description = "Identifiant de l'Internet Gateway staging."
  value       = module.network.internet_gateway_id
}

output "public_route_table_id" {
  description = "Identifiant de la table de routage publique staging."
  value       = module.network.public_route_table_id
}

output "private_route_table_id" {
  description = "Identifiant de la table de routage privée staging."
  value       = module.network.private_route_table_id
}

output "alb_security_group_id" {
  description = "Identifiant du Security Group ALB staging."
  value       = module.security_groups.alb_security_group_id
}

output "ecs_security_group_id" {
  description = "Identifiant du Security Group ECS staging."
  value       = module.security_groups.ecs_security_group_id
}

output "database_security_group_id" {
  description = "Identifiant du Security Group PostgreSQL staging."
  value       = module.security_groups.database_security_group_id
}

output "alb_arn" {
  description = "ARN de l'Application Load Balancer staging."
  value       = module.alb.alb_arn
}

output "alb_dns_name" {
  description = "Nom DNS public de l'Application Load Balancer staging."
  value       = module.alb.alb_dns_name
}

output "alb_zone_id" {
  description = "Zone ID Route 53 de l'Application Load Balancer staging."
  value       = module.alb.alb_zone_id
}

output "http_listener_arn" {
  description = "ARN du listener HTTP staging."
  value       = module.alb.http_listener_arn
}

output "frontend_target_group_arn" {
  description = "ARN du target group frontend blue staging."
  value       = module.alb.frontend_target_group_arn
}

output "api_gateway_target_group_arn" {
  description = "ARN du target group API Gateway blue staging."
  value       = module.alb.api_gateway_target_group_arn
}

output "frontend_target_group_arns" {
  description = "ARN blue et green des target groups frontend staging."
  value       = module.alb.frontend_target_group_arns
}

output "api_gateway_target_group_arns" {
  description = "ARN blue et green des target groups API Gateway staging."
  value       = module.alb.api_gateway_target_group_arns
}

output "ecs_cluster_id" {
  description = "Identifiant du cluster ECS staging."
  value       = aws_ecs_cluster.this.id
}

output "ecs_cluster_name" {
  description = "Nom du cluster ECS staging."
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_names" {
  description = "Noms des services ECS staging indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.service_name }
}

output "ecs_service_arns" {
  description = "ARN des services ECS staging indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.service_arn }
}

output "task_definition_arns" {
  description = "ARN des task definitions staging indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.task_definition_arn }
}

output "log_group_names" {
  description = "Noms des groupes CloudWatch Logs staging indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.log_group_name }
}

output "service_discovery_namespace_id" {
  description = "Identifiant du namespace Cloud Map prive staging."
  value       = aws_service_discovery_private_dns_namespace.this.id
}

output "service_discovery_namespace_name" {
  description = "Nom DNS du namespace Cloud Map prive staging."
  value       = aws_service_discovery_private_dns_namespace.this.name
}
