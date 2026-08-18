variable "project_name" {
  description = "Nom du projet utilise comme prefixe des repositories ECR partages."
  type        = string

  validation {
    condition     = length(trimspace(var.project_name)) > 0
    error_message = "project_name ne doit pas etre vide."
  }
}

variable "repository_names" {
  description = "Noms uniques et non vides des composants possedant un repository ECR."
  type        = list(string)

  validation {
    condition     = length(var.repository_names) > 0
    error_message = "repository_names doit contenir au moins un nom."
  }

  validation {
    condition     = length(distinct(var.repository_names)) == length(var.repository_names)
    error_message = "repository_names ne doit contenir aucune valeur dupliquee."
  }

  validation {
    condition     = alltrue([for name in var.repository_names : length(trimspace(name)) > 0])
    error_message = "repository_names ne doit contenir aucune chaine vide."
  }
}
