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

output "github_oidc_provider_arn" {
  description = "ARN du fournisseur OIDC GitHub Actions."
  value       = module.github_oidc.provider_arn
}

output "github_deploy_role_arn" {
  description = "ARN du role de deploiement GitHub Actions."
  value       = module.github_oidc.deploy_role_arn
}
