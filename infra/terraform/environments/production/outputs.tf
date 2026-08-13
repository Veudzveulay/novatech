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

output "ecs_cluster_id" {
  description = "Identifiant du cluster ECS production."
  value       = aws_ecs_cluster.this.id
}

output "ecs_cluster_name" {
  description = "Nom du cluster ECS production."
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_names" {
  description = "Noms des services ECS production indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.service_name }
}

output "ecs_service_arns" {
  description = "ARN des services ECS production indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.service_arn }
}

output "task_definition_arns" {
  description = "ARN des task definitions production indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.task_definition_arn }
}

output "log_group_names" {
  description = "Noms des groupes CloudWatch Logs production indexes par composant."
  value       = { for name, service in module.ecs_services : name => service.log_group_name }
}

output "service_discovery_namespace_id" {
  description = "Identifiant du namespace Cloud Map prive production."
  value       = aws_service_discovery_private_dns_namespace.this.id
}

output "service_discovery_namespace_name" {
  description = "Nom DNS du namespace Cloud Map prive production."
  value       = aws_service_discovery_private_dns_namespace.this.name
}

output "db_instance_id" {
  description = "Identifiant de l'instance RDS PostgreSQL production."
  value       = module.database.db_instance_id
}

output "db_endpoint" {
  description = "Endpoint de l'instance RDS PostgreSQL production."
  value       = module.database.db_endpoint
}

output "db_address" {
  description = "Adresse DNS de l'instance RDS PostgreSQL production."
  value       = module.database.db_address
}

output "db_port" {
  description = "Port de l'instance RDS PostgreSQL production."
  value       = module.database.db_port
}

output "db_name" {
  description = "Nom initial de la base PostgreSQL production."
  value       = module.database.db_name
}

output "master_user_secret_arn" {
  description = "ARN du secret maitre RDS production gere par AWS."
  value       = module.database.master_user_secret_arn
}
