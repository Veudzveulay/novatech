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
