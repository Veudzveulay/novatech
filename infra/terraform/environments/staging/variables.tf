variable "project_name" {
  description = "Nom générique du projet utilisé pour le nommage des futures ressources."
  type        = string
}

variable "environment" {
  description = "Nom de l'environnement Terraform."
  type        = string

  validation {
    condition     = var.environment == "staging"
    error_message = "Dans cette racine Terraform, environment doit valoir staging."
  }
}

variable "aws_region" {
  description = "Région AWS cible, à confirmer avant toute opération connectée."
  type        = string
}

variable "vpc_cidr" {
  description = "Plage CIDR prévue pour le VPC de staging."
  type        = string
}

variable "availability_zones" {
  description = "Zones de disponibilité prévues pour staging."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Plages CIDR des deux subnets publics de staging."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Plages CIDR des deux subnets privés de staging."
  type        = list(string)
}

variable "budget_limit_eur" {
  description = "Limite budgétaire indicative de l'environnement, en euros."
  type        = number
}

variable "image_uris" {
  description = "URI immuables fictives ou reelles des six images applicatives."
  type        = map(string)

  validation {
    condition = toset(keys(var.image_uris)) == toset([
      "frontend",
      "api-gateway",
      "auth",
      "paie",
      "conges",
      "recrutement"
    ])
    error_message = "image_uris doit contenir exactement les six composants NovaTech."
  }

  validation {
    condition     = alltrue([for uri in values(var.image_uris) : length(trimspace(uri)) > 0 && !can(regex(":latest$", uri))])
    error_message = "Chaque image URI doit etre non vide et ne pas utiliser latest."
  }
}
