variable "project_name" {
  description = "Nom du projet utilisé pour le nommage et les tags."
  type        = string

  validation {
    condition     = length(trimspace(var.project_name)) > 0
    error_message = "project_name ne doit pas être vide."
  }
}

variable "environment" {
  description = "Environnement auquel appartiennent les Security Groups."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "vpc_id" {
  description = "Identifiant du VPC qui hébergera les Security Groups."
  type        = string

  validation {
    condition     = length(trimspace(var.vpc_id)) > 0
    error_message = "vpc_id ne doit pas être vide."
  }
}
