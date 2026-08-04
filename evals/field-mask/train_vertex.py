import os
from google.cloud import aiplatform

# Initialize the Vertex AI SDK
aiplatform.init(
    project='geojson-bq-blog',
    location='us-central1',
    staging_bucket='gs://geojson-bq-blog-staging'
)

def submit_training_job():
    job = aiplatform.CustomJob.from_local_script(
        display_name="gemma-4-field-mask-finetune",
        script_path="train.py",
        container_uri="us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-2.py310:latest",
        requirements=[
            "transformers>=4.40.0",
            "datasets",
            "trl",
            "peft",
            "accelerate"
        ],
        replica_count=1,
        machine_type="g2-standard-4",
        accelerator_type="NVIDIA_L4",
        accelerator_count=1,
    )
    
    # Enable spot instances to reduce costs further
    job.scheduling = {"is_spot": True}
    
    print("Starting Vertex AI Custom Job for Gemma 4 Fine-tuning...")
    job.run(sync=False)
    print(f"Job submitted! Job ID: {job.name}")
    print(f"View in console: https://console.cloud.google.com/vertex-ai/training/custom-jobs/{job.name}?project=geojson-bq-blog")

if __name__ == "__main__":
    submit_training_job()
