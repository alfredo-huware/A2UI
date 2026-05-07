def get_resources() -> str:
    """
    Fetches the current state of cloud resources.

    Returns:
        A string summarizing the current cloud resources.
    """
    return (
        "Project: production-env-123\n"
        "Resources:\n"
        "- Compute Engine: 3 instances (running)\n"
        "- Cloud Storage: 12 buckets (total 1.5TB)\n"
        "- Cloud SQL: 1 instance (db-n1-standard-1, status: READY)\n"
        "- GKE Clusters: 1 (status: RECONCILING)"
    )
