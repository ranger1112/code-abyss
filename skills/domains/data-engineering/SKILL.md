---
name: data-engineering
description: 数据工程。Airflow、Dagster、Kafka Streams、Flink、dbt、数据管道、流处理、数据质量。当用户提到数据管道、ETL、流处理、数据质量时路由到此。
license: MIT
user-invocable: false
disable-model-invocation: false
---

# 数据工程域 · Data Engineering

```
编排：Airflow(调度) | Dagster(资产) | Prefect(现代流)
流处理：Kafka Streams(嵌入式) | Flink(集群) | Spark Streaming
质量：Great Expectations | dbt tests | Soda Core
```

---

## 管道编排

| 特性 | Airflow | Dagster | Prefect |
|------|---------|---------|---------|
| 核心模型 | DAG+Task | Asset+Op | Flow+Task |
| 资产管理 | 无 | 原生 | 无 |
| 本地开发 | 复杂 | 简单 | 简单 |

Airflow：`@task` 装饰器+自动 XCom | `.expand()` 动态映射 | `retries=3, retry_exponential_backoff=True`
Dagster：`@asset(group_name, deps)` + `ConfigurableResource` + `DailyPartitionsDefinition` + `@asset_check`
Prefect：`@flow` + `@task(retries=3, cache_key_fn=task_input_hash)` + `ConcurrentTaskRunner`

### 编排检查项

幂等(UPSERT/分区覆盖) | 增量(`WHERE updated_at > last_run`) | 事件驱动触发 | 跨 DAG 依赖 | 数据血缘(`ref()`/Asset deps)

---

## 流处理

| 特性 | Kafka Streams | Flink | Spark Streaming |
|------|---------------|-------|-----------------|
| 部署 | 嵌入式 JVM | 独立集群 | 独立集群 |
| 状态 | RocksDB | RocksDB/内存 | 内存 |
| 窗口 | 丰富 | 最丰富 | 基础 |

Kafka Streams：`StreamsBuilder` → `stream/filter/map` → `groupByKey().aggregate()` → `to()` | Join(Stream-Stream/Stream-Table) | `EXACTLY_ONCE_V2`
Flink：Tumbling/Sliding/Session 窗口 | `aggregate(AggregateFunction)` | ValueState/ListState+TTL | `enableCheckpointing(60000)` + Watermark(`forBoundedOutOfOrderness`) | 数据倾斜→随机前缀打散

### 流处理检查项

时间语义选择 | Watermark 乱序容忍 | 状态 TTL 防膨胀 | Checkpoint 间隔 | 端到端 Exactly-Once | 背压监控

---

## 数据质量

维度：`完整性 → 准确性 → 一致性 → 及时性 → 有效性`

| 工具 | 优势 | 适用 |
|------|------|------|
| Great Expectations | 丰富 Expectations、Data Docs | Python 生态、复杂验证 |
| dbt | SQL 原生、血缘追踪 | 数仓转换测试 |
| Soda Core | 简洁 YAML | 快速验证、CI/CD |

GE：`gx.get_context()` → 数据源 → `row_count_between`/`not_be_null`/`be_unique`/`be_between` → Checkpoints
dbt：`unique`/`not_null`/`accepted_values`/`relationships` + `dbt_expectations` + `--store-failures`
Soda：`row_count > N` / `missing_count(col) = 0` / `freshness(ts) < 1d`

### 质量检查项

分层验证(源→转换→目标) | 完整性+准确性+一致性 | 及时性阈值 | 加权评分 | 告警(Slack/PagerDuty)

## 触发词

数据管道、Airflow、Dagster、Prefect、ETL、流处理、Kafka Streams、Flink、数据质量、dbt、数据血缘
