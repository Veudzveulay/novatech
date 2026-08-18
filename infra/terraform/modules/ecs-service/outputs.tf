output "service_name" {
  description = "Nom du service ECS."
  value       = aws_ecs_service.this.name
}

output "service_arn" {
  description = "ARN du service ECS."
  value       = aws_ecs_service.this.id
}

output "task_definition_arn" {
  description = "ARN de la revision de task definition."
  value       = aws_ecs_task_definition.this.arn
}

output "log_group_name" {
  description = "Nom du groupe de logs CloudWatch."
  value       = aws_cloudwatch_log_group.this.name
}
