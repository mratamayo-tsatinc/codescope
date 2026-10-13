/*
@codescope
@title Clinic Queue Assignment
@seed serviceCode min=1 max=3
@seed patientAge min=16 max=72 step=7
@seed waiting min=10 max=40 step=5
*/
#include <stdio.h>

int main(void)
{
    int serviceCode = 2;
    int patientAge = 65;
    int waiting = 25;
    int room;
    int queueNumber;

    switch (serviceCode)
    {
        case 1:
            room = 101;
            break;
        case 2:
            room = 205;
            break;
        default:
            room = 310;
    }

    queueNumber = serviceCode * 100 + waiting;

    if (patientAge >= 60) {
        queueNumber = queueNumber - 10;
    }

    printf("CLINIC QUEUE\n");
    printf("Proceed to room %d\n", room);
    printf("Queue number: %d\n", queueNumber);

    return 0;
}

