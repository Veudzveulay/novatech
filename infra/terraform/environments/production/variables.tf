variable "project_name" {
  description = "Nom générique du projet utilisé pour le nommage des futures ressources."
  type        = string
}

variable "environment" {
  description = "Nom de l'environnement Terraform."
  type        = string

  validation {
    condition     = var.environment == "production"
    error_message = "Dans cette racine Terraform, environment doit valoir production."
  }
}

variable "aws_region" {
  description = "Région AWS cible, à confirmer avant toute opération connectée."
  type        = string
}

variable "vpc_cidr" {
  description = "Plage CIDR prévue pour le VPC de production."
  type        = string
}

variable "availability_zones" {
  description = "Zones de disponibilité prévues pour production."
  type        = list(string)
}

variable "budget_limit_eur" {
  description = "Limite budgétaire indicative de l'environnement, en euros."
  type        = number
}
