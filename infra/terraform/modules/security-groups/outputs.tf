output "alb_security_group_id" {
  description = "Identifiant du Security Group du futur ALB."
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Identifiant du Security Group des futures tâches ECS."
  value       = aws_security_group.ecs.id
}

output "database_security_group_id" {
  description = "Identifiant du Security Group de la future base PostgreSQL."
  value       = aws_security_group.database.id
}
