variable "project_name" {
  description = "Nom du projet utilise pour le nommage et les tags."
  type        = string

  validation {
    condition     = length(trimspace(var.project_name)) > 0
    error_message = "project_name ne doit pas etre vide."
  }
}

variable "environment" {
  description = "Environnement auquel appartient l'ALB."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment doit valoir staging ou production."
  }
}

variable "vpc_id" {
  description = "Identifiant du VPC contenant les target groups."
  type        = string

  validation {
    condition     = length(trimspace(var.vpc_id)) > 0
    error_message = "vpc_id ne doit pas etre vide."
  }
}

variable "public_subnet_ids" {
  description = "Identifiants des deux subnets publics de l'ALB."
  type        = list(string)

  validation {
    condition = (
      length(var.public_subnet_ids) == 2 &&
      length(distinct(var.public_subnet_ids)) == 2 &&
      alltrue([for id in var.public_subnet_ids : length(trimspace(id)) > 0])
    )
    error_message = "public_subnet_ids doit contenir exactement deux identifiants distincts et non vides."
  }
}

variable "alb_security_group_id" {
  description = "Identifiant du Security Group attache a l'ALB."
  type        = string

  validation {
    condition     = length(trimspace(var.alb_security_group_id)) > 0
    error_message = "alb_security_group_id ne doit pas etre vide."
  }
}

variable "certificate_arn" {
  description = "ARN facultatif du certificat ACM. Sans valeur, l'ALB reste accessible en HTTP uniquement."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition = (
      var.certificate_arn == null ||
      can(regex("^arn:[^:]+:acm:[^:]+:[0-9]{12}:certificate/.+$", var.certificate_arn))
    )
    error_message = "certificate_arn doit etre null ou contenir un ARN de certificat ACM valide."
  }
}

variable "frontend_health_check_path" {
  description = "Chemin de sante Nginx du frontend."
  type        = string
  default     = "/health"

  validation {
    condition     = startswith(var.frontend_health_check_path, "/")
    error_message = "frontend_health_check_path doit commencer par /."
  }
}

variable "api_path_patterns" {
  description = "Patterns du listener envoyes vers l'API Gateway."
  type        = list(string)
  default     = ["/api/*"]

  validation {
    condition = (
      length(var.api_path_patterns) > 0 &&
      alltrue([for pattern in var.api_path_patterns : startswith(pattern, "/")])
    )
    error_message = "api_path_patterns doit contenir au moins un pattern commencant par /."
  }
}
