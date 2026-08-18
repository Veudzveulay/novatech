variable "project_name" {
  description = "Nom du projet utilisé dans les tags des ressources réseau."
  type        = string

  validation {
    condition     = length(trimspace(var.project_name)) > 0
    error_message = "project_name ne doit pas être vide."
  }
}

variable "environment" {
  description = "Environnement auquel appartient le réseau."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "vpc_cidr" {
  description = "Plage CIDR IPv4 du VPC."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr doit être une plage CIDR IPv4 valide."
  }
}

variable "availability_zones" {
  description = "Deux zones de disponibilité distinctes utilisées par les subnets."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) == 2 && length(distinct(var.availability_zones)) == 2
    error_message = "availability_zones doit contenir exactement deux zones distinctes."
  }
}

variable "public_subnet_cidrs" {
  description = "Deux plages CIDR IPv4 distinctes pour les subnets publics."
  type        = list(string)

  validation {
    condition = (
      length(var.public_subnet_cidrs) == 2 &&
      length(distinct(var.public_subnet_cidrs)) == 2 &&
      alltrue([for cidr in var.public_subnet_cidrs : can(cidrnetmask(cidr))])
    )
    error_message = "public_subnet_cidrs doit contenir exactement deux plages CIDR IPv4 distinctes et valides."
  }
}

variable "private_subnet_cidrs" {
  description = "Deux plages CIDR IPv4 distinctes pour les subnets privés."
  type        = list(string)

  validation {
    condition = (
      length(var.private_subnet_cidrs) == 2 &&
      length(distinct(var.private_subnet_cidrs)) == 2 &&
      alltrue([for cidr in var.private_subnet_cidrs : can(cidrnetmask(cidr))])
    )
    error_message = "private_subnet_cidrs doit contenir exactement deux plages CIDR IPv4 distinctes et valides."
  }

  validation {
    condition = length(distinct(concat(
      var.public_subnet_cidrs,
      var.private_subnet_cidrs
    ))) == 4
    error_message = "Les plages CIDR publiques et privées doivent toutes être distinctes."
  }
}
