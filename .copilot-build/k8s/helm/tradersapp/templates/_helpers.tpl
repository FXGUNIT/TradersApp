{{- /*
k8s/helm/tradersapp/templates/_helpers.tpl
Helper templates for TradersApp Helm chart
*/ -}}
{{/* Expand the name */}}
{{- define "tradersapp.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Full name with release */}}
{{- define "tradersapp.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* ML Engine full name */}}
{{- define "mlEngine.fullname" -}}
{{- printf "%s-ml-engine" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* BFF full name */}}
{{- define "bff.fullname" -}}
{{- printf "%s-bff" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Frontend full name */}}
{{- define "frontend.fullname" -}}
{{- printf "%s-frontend" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Selector labels for all components */}}
{{- define "tradersapp.labels" -}}
app.kubernetes.io/name: {{ include "tradersapp.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/component: {{ .Chart.Name }}
app.kubernetes.io/part-of: tradersapp
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{/* Namespace label */}}
{{- define "tradersapp.namespace" -}}
{{- .Values.namespace | default "tradersapp" }}
{{- end }}

{{/* Image pull policy */}}
{{- define "tradersapp.imagePullPolicy" -}}
{{- .pullPolicy | default "IfNotPresent" }}
{{- end }}

{{/* Optional imagePullSecrets block */}}
{{- define "tradersapp.imagePullSecrets" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{/* Optional tolerations block */}}
{{- define "tradersapp.tolerations" -}}
{{- with .Values.tolerations }}
tolerations:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{/* Optional nodeSelector block */}}
{{- define "tradersapp.nodeSelector" -}}
{{- with .Values.nodeSelector }}
nodeSelector:
  {{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}
