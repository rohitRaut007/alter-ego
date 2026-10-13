from celery import shared_task

from .services import run_generation


@shared_task(name="protocol.generate")
def generate_protocol_task(protocol_id: str) -> None:
    run_generation(protocol_id)
