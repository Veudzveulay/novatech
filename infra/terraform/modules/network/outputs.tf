output "vpc_id" {
  description = "Identifiant du VPC."
  value       = aws_vpc.this.id
}

output "public_subnet_ids" {
  description = "Identifiants des deux subnets publics."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Identifiants des deux subnets privés."
  value       = aws_subnet.private[*].id
}

output "internet_gateway_id" {
  description = "Identifiant de l'Internet Gateway."
  value       = aws_internet_gateway.this.id
}

output "public_route_table_id" {
  description = "Identifiant de la table de routage publique."
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "Identifiant de la table de routage privée sans sortie Internet."
  value       = aws_route_table.private.id
}
