locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = toset(var.secret_names)

  name        = "${var.project_name}/${var.environment}/${each.value}"
  description = "Conteneur du secret ${each.value} pour ${var.project_name} ${var.environment}."

  tags = merge(local.common_tags, { Secret = each.value })
}
