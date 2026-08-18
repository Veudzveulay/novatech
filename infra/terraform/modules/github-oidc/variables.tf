variable "project_name" {
  description = "Nom du projet utilise dans les ARN cibles."
  type        = string
}

variable "github_repository" {
  description = "Repository GitHub autorise au format owner/repository."
  type        = string

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repository))
    error_message = "github_repository doit respecter le format owner/repository."
  }
}

variable "repository_arns" {
  description = "ARN exacts des six repositories ECR partages."
  type        = list(string)

  validation {
    condition     = length(var.repository_arns) == 6
    error_message = "repository_arns doit contenir exactement six ARN ECR."
  }
}

variable "aws_region" {
  description = "Region des clusters et services ECS cibles."
  type        = string
}
