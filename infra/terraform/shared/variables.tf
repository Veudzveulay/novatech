variable "project_name" {
  description = "Nom generique du projet utilise comme prefixe des repositories partages."
  type        = string
}

variable "aws_region" {
  description = "Region AWS cible, a confirmer avant toute operation connectee."
  type        = string
}

variable "repository_names" {
  description = "Noms des composants possedant un repository ECR partage."
  type        = list(string)

  validation {
    condition = length(var.repository_names) == 6 && toset(var.repository_names) == toset([
      "frontend",
      "api-gateway",
      "auth",
      "paie",
      "conges",
      "recrutement"
    ])
    error_message = "repository_names doit contenir exactement les six composants NovaTech attendus."
  }
}
