locals {
  name_prefix = substr("${var.project_name}-${var.environment}", 0, 20)

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  application_listener_arn = var.certificate_arn == null ? aws_lb_listener.http.arn : aws_lb_listener.https[0].arn

  target_groups = {
    frontend-blue = {
      component   = "frontend"
      color       = "blue"
      port        = 80
      health_path = var.frontend_health_check_path
      suffix      = "fe-blue"
    }
    frontend-green = {
      component   = "frontend"
      color       = "green"
      port        = 80
      health_path = var.frontend_health_check_path
      suffix      = "fe-green"
    }
    api-gateway-blue = {
      component   = "api-gateway"
      color       = "blue"
      port        = 3000
      health_path = "/health"
      suffix      = "api-blue"
    }
    api-gateway-green = {
      component   = "api-gateway"
      color       = "green"
      port        = 3000
      health_path = "/health"
      suffix      = "api-green"
    }
  }
}

resource "aws_lb" "this" {
  name                       = "${local.name_prefix}-alb"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb"
  })
}

resource "aws_lb_target_group" "this" {
  for_each = local.target_groups

  name                 = "${local.name_prefix}-${each.value.suffix}"
  port                 = each.value.port
  protocol             = "HTTP"
  vpc_id               = var.vpc_id
  target_type          = "ip"
  deregistration_delay = 30

  health_check {
    enabled             = true
    protocol            = "HTTP"
    path                = each.value.health_path
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = merge(local.common_tags, {
    Component = each.value.component
    Color     = each.value.color
  })
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = var.certificate_arn == null ? [] : [1]

    content {
      type = "redirect"

      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = var.certificate_arn == null ? [1] : []

    content {
      type = "fixed-response"

      fixed_response {
        content_type = "text/plain"
        message_body = "Not found"
        status_code  = "404"
      }
    }
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "https" {
  count = var.certificate_arn == null ? 0 : 1

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }

  tags = local.common_tags
}

resource "aws_lb_listener_rule" "api_gateway" {
  listener_arn = local.application_listener_arn
  priority     = 100

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.this["api-gateway-blue"].arn
        weight = 1
      }

      target_group {
        arn    = aws_lb_target_group.this["api-gateway-green"].arn
        weight = 0
      }
    }
  }

  condition {
    path_pattern {
      values = var.api_path_patterns
    }
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [action[0].forward[0].target_group]
  }
}

resource "aws_lb_listener_rule" "api_gateway_preview" {
  listener_arn = local.application_listener_arn
  priority     = 10

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.this["api-gateway-blue"].arn
        weight = 0
      }

      target_group {
        arn    = aws_lb_target_group.this["api-gateway-green"].arn
        weight = 1
      }
    }
  }

  condition {
    http_header {
      http_header_name = "X-NovaTech-Preview"
      values           = ["api-gateway"]
    }
  }

  condition {
    path_pattern {
      values = var.api_path_patterns
    }
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [action[0].forward[0].target_group]
  }
}

resource "aws_lb_listener_rule" "frontend" {
  listener_arn = local.application_listener_arn
  priority     = 200

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.this["frontend-blue"].arn
        weight = 1
      }

      target_group {
        arn    = aws_lb_target_group.this["frontend-green"].arn
        weight = 0
      }
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [action[0].forward[0].target_group]
  }
}

resource "aws_lb_listener_rule" "frontend_preview" {
  listener_arn = local.application_listener_arn
  priority     = 20

  action {
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.this["frontend-blue"].arn
        weight = 0
      }

      target_group {
        arn    = aws_lb_target_group.this["frontend-green"].arn
        weight = 1
      }
    }
  }

  condition {
    http_header {
      http_header_name = "X-NovaTech-Preview"
      values           = ["frontend"]
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = local.common_tags

  lifecycle {
    ignore_changes = [action[0].forward[0].target_group]
  }
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  for_each = local.target_groups

  alarm_name          = "${local.name_prefix}-${each.key}-unhealthy"
  alarm_description   = "Detecte au moins une cible unhealthy pour ${each.key}."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.this.arn_suffix
    TargetGroup  = aws_lb_target_group.this[each.key].arn_suffix
  }

  tags = merge(local.common_tags, {
    Component = each.value.component
    Color     = each.value.color
  })
}
