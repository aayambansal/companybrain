#!/usr/bin/env python3
"""
Score a CompanyBrain BEIR run with pytrec_eval (the standard TREC evaluator).

    python3 bench/trec_eval.py <run_tag> <mode> [beir_dir] [qrels_dataset]

Reads <beir_dir>/<run_tag>_<mode>.run.json and scores it against
<beir_dir>/<qrels_dataset>/qrels/test.tsv (qrels_dataset defaults to run_tag,
so A/B variants like "nfcorpus_large" can be scored against the base dataset's
qrels by passing qrels_dataset=nfcorpus). Prints nDCG@10, Recall@10/@100, MRR, MAP.
"""
import json
import sys
import os
import pytrec_eval


def load_qrels(path):
    qrels = {}
    with open(path) as f:
        next(f)  # header
        for line in f:
            parts = line.strip().split("\t")
            if len(parts) < 3:
                continue
            qid, docid, score = parts[0], parts[1], int(parts[2])
            qrels.setdefault(qid, {})[docid] = score
    return qrels


def main():
    run_tag, mode = sys.argv[1], sys.argv[2]
    beir_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join("bench", "beir")
    qrels_dataset = sys.argv[4] if len(sys.argv) > 4 else run_tag
    qrels = load_qrels(os.path.join(beir_dir, qrels_dataset, "qrels", "test.tsv"))
    with open(os.path.join(beir_dir, f"{run_tag}_{mode}.run.json")) as f:
        run = json.load(f)

    evaluator = pytrec_eval.RelevanceEvaluator(
        qrels, {"ndcg_cut.10", "recall.10", "recall.100", "recip_rank", "map"}
    )
    results = evaluator.evaluate(run)
    n = len(results)

    def avg(metric):
        return sum(m[metric] for m in results.values()) / n if n else 0.0

    print(
        json.dumps(
            {
                "run": run_tag,
                "mode": mode,
                "queries": n,
                "ndcg@10": round(avg("ndcg_cut_10"), 4),
                "recall@10": round(avg("recall_10"), 4),
                "recall@100": round(avg("recall_100"), 4),
                "mrr": round(avg("recip_rank"), 4),
                "map": round(avg("map"), 4),
            }
        )
    )


if __name__ == "__main__":
    main()
