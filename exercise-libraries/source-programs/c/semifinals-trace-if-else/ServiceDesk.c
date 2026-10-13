/*
@codescope
@title Service Desk Routing
@seed priority min=1 max=3
@seed waitingMinutes min=20 max=80 step=10
@seed team min=1 max=2
*/
#include <stdio.h>

int main(void)
{
    int priority = 2;
    int waitingMinutes = 40;
    int team = 1;
    int queueCode;

    if (priority >= 2) {
        if (waitingMinutes > 30) {
            queueCode = team + 20;
        } else {
            queueCode = team + 10;
        }
    } else {
        if (waitingMinutes > 60) {
            queueCode = team + 30;
        } else {
            queueCode = team;
        }
    }

    printf("SERVICE DESK ROUTING\n");
    printf("Assigned queue: Q%d\n", queueCode);

    return 0;
}

