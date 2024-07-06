# sapi-utils

This package add some useful functions for minecraft script API.

current compatible @minecraft/server version: `1.10.0-beta`, `1.11.0-beta`, `1.12.0-beta`, `1.13.0-beta`

current compatible @minecraft/server-ui version: `1.2.0-beta`, `1.2.0`, `1.3.0-beta`

# Quest API

These translate string should be added to your pack:
```text
sapi-utils.quest.condition.not_satisfied.item=You need %%1 more %%2!
sapi-utils.quest.condition.not_satisfied.quest=%%1 is not completed!
sapi-utils.quest.condition.not_satisfied.level=You need %%1 more level(s)!
sapi-utils.quest.condition.not_satisfied.experience=You need %%1 more experience!
sapi-utils.quest.condition=Completion condition: 
sapi-utils.quest.condition.item=%%1 %%2
sapi-utils.quest.condition.quest=Quest %%1
sapi-utils.quest.condition.level=%%1 level(s)
sapi-utils.quest.condition.experience=%%1 experience point(s)
sapi-utils.quest.condition.none=None
sapi-utils.quest.reward=Completion reward: 
sapi-utils.quest.reward.item=%%1 %%2
sapi-utils.quest.reward.level=%%1 level(s)
sapi-utils.quest.reward.experience=%%1 experience point(s)
sapi-utils.quest.reward.none=None
sapi-utils.quest.check=Submit
sapi-utils.quest.finished=[Finished]
```