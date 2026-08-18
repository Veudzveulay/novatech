output "provider_arn" {
  description = "ARN du fournisseur OIDC GitHub Actions."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "deploy_role_arn" {
  description = "ARN du role de deploiement assume par GitHub Actions."
  value       = aws_iam_role.github_deploy.arn
}
