output "repository_urls" {
  description = "URLs des repositories ECR indexees par nom de composant."
  value       = { for name, repository in aws_ecr_repository.this : name => repository.repository_url }
}

output "repository_arns" {
  description = "ARN des repositories ECR indexes par nom de composant."
  value       = { for name, repository in aws_ecr_repository.this : name => repository.arn }
}

output "repository_names" {
  description = "Noms AWS complets des repositories ECR indexes par nom de composant."
  value       = { for name, repository in aws_ecr_repository.this : name => repository.name }
}
