output "secret_arns" {
  description = "ARN des conteneurs de secrets indexes par nom logique."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "secret_names" {
  description = "Noms AWS des conteneurs de secrets indexes par nom logique."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.name }
}
