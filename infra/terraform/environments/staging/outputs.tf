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
