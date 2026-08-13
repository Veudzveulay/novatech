variable "project_name" {
  description = "Nom du projet utilise pour le nommage et les tags."
  type        = string

  validation {
    condition = (
      length(var.project_name) <= 40 &&
      can(regex("^[A-Za-z]([A-Za-z0-9-]*[A-Za-z0-9])?$", var.project_name)) &&
      !strcontains(var.project_name, "--")
    )
    error_message = "project_name doit commencer par une lettre, contenir au maximum 40 lettres, chiffres ou tirets, sans double tiret ni tiret final."
  }
}

variable "environment" {
  description = "Environnement auquel appartient la base."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "private_subnet_ids" {
  description = "Identifiants des deux subnets prives du DB subnet group."
  type        = list(string)

  validation {
    condition = (
      length(var.private_subnet_ids) == 2 &&
      length(distinct(var.private_subnet_ids)) == 2 &&
      alltrue([for id in var.private_subnet_ids : length(trimspace(id)) > 0])
    )
    error_message = "private_subnet_ids doit contenir exactement deux identifiants distincts et non vides."
  }
}

variable "database_security_group_id" {
  description = "Identifiant du Security Group PostgreSQL existant."
  type        = string

  validation {
    condition     = length(trimspace(var.database_security_group_id)) > 0
    error_message = "database_security_group_id ne doit pas etre vide."
  }
}

variable "db_name" {
  description = "Nom initial de la base PostgreSQL."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9]{0,62}$", var.db_name))
    error_message = "db_name doit commencer par une lettre et contenir au maximum 63 caracteres alphanumeriques."
  }
}

variable "db_username" {
  description = "Nom non sensible de l'utilisateur maitre PostgreSQL."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z][A-Za-z0-9_]{0,62}$", var.db_username))
    error_message = "db_username doit commencer par une lettre et contenir au maximum 63 lettres, chiffres ou underscores."
  }
}

variable "instance_class" {
  description = "Classe de l'instance RDS."
  type        = string

  validation {
    condition     = startswith(var.instance_class, "db.")
    error_message = "instance_class doit commencer par db.."
  }
}

variable "allocated_storage" {
  description = "Stockage alloue en GiB."
  type        = number

  validation {
    condition     = var.allocated_storage >= 20
    error_message = "allocated_storage doit etre au moins egal a 20 GiB."
  }
}

variable "backup_retention_period" {
  description = "Retention des sauvegardes automatiques en jours."
  type        = number

  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "backup_retention_period doit etre compris entre 1 et 35 jours."
  }
}

variable "deletion_protection" {
  description = "Active la protection contre la suppression de l'instance."
  type        = bool
}

variable "skip_final_snapshot" {
  description = "Autorise la suppression sans snapshot final dans le sandbox."
  type        = bool
}
