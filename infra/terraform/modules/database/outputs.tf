output "db_instance_id" {
  description = "Identifiant de l'instance RDS PostgreSQL."
  value       = aws_db_instance.this.id
}

output "db_endpoint" {
  description = "Endpoint RDS incluant le port."
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "Adresse DNS de l'instance RDS."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Port PostgreSQL de l'instance RDS."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Nom initial de la base PostgreSQL."
  value       = aws_db_instance.this.db_name
}

output "master_user_secret_arn" {
  description = "ARN du secret du mot de passe maitre gere nativement par RDS."
  value       = try(aws_db_instance.this.master_user_secret[0].secret_arn, null)
}
