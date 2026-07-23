# Deploys

We deploy to production every Thursday at 2pm. Deploys are frozen during the
last week of the quarter unless the change is a security fix.

Rollbacks are one command: `make rollback`. The on-call engineer owns any
incident until it is resolved or handed off.
