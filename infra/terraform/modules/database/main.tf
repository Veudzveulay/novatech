locals {
  name_prefix = lower("${var.project_name}-${var.environment}")

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnets"
  })
}

resource "aws_db_instance" "this" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  instance_class = var.instance_class

  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  port     = 5432

  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.database_security_group_id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = var.backup_retention_period
  copy_tags_to_snapshot   = true

  deletion_protection       = var.deletion_protection
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name_prefix}-final"

  auto_minor_version_upgrade = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })
}
