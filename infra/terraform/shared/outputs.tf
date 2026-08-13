output "repository_urls" {
  description = "URLs des repositories ECR indexees par nom de composant."
  value       = module.ecr.repository_urls
}

output "repository_arns" {
  description = "ARN des repositories ECR indexes par nom de composant."
  value       = module.ecr.repository_arns
}

output "repository_names" {
  description = "Noms AWS complets des repositories ECR indexes par nom de composant."
  value       = module.ecr.repository_names
}
