variable "project_name" {
  description = "Nom du projet utilise pour le nommage et les tags."
  type        = string
}

variable "environment" {
  description = "Environnement des conteneurs de secrets."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "secret_names" {
  description = "Noms non sensibles des conteneurs Secrets Manager a creer."
  type        = list(string)

  validation {
    condition = length(var.secret_names) == length(distinct(var.secret_names)) && alltrue([
      for name in var.secret_names : can(regex("^[A-Za-z0-9/_+=.@-]+$", name)) && length(name) > 0
    ])
    error_message = "secret_names doit contenir des noms uniques et valides pour Secrets Manager."
  }
}
