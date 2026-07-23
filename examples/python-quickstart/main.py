"""CompanyBrain Python quickstart: add a memory, search, then chat."""

import os

from companybrain import CompanyBrain


def main() -> None:
    cb = CompanyBrain(
        api_url=os.environ.get("COMPANYBRAIN_API_URL"),
        api_key=os.environ.get("COMPANYBRAIN_API_KEY"),
    )

    # 1. Add a memory.
    memory = cb.memories.add(
        "We deploy to production every Thursday at 2pm.",
        title="Deploy schedule",
        tags=["ops"],
    )
    print(f"added memory {memory['id']}")

    # 2. Hybrid search.
    results = cb.search("when do we deploy", mode="hybrid", limit=5)
    print(f"\nsearch hits ({len(results['hits'])}):")
    for hit in results["hits"]:
        title = hit["document"]["title"] or "Untitled"
        print(f"  {hit['score']:.3f}  {title}")

    # 3. Ask a question.
    answer = cb.chat("When do we deploy to production?")
    print(f"\nanswer: {answer['message']}")
    for citation in answer["citations"]:
        print(f"  [{citation['index']}] {citation['title'] or 'Untitled'}")


if __name__ == "__main__":
    main()
