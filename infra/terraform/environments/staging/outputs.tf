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
