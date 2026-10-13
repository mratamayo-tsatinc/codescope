/*
@codescope
@title Support Queue
@seed issueCode min=1 max=4
@seed waiting min=5 max=20 step=5
*/
#include <stdio.h>

int main(void)
{
    int issueCode = 3;
    int waiting = 10;
    int desk;

    switch (issueCode)
    {
        case 1:
            desk = 101;
            break;
        case 2:
            desk = 202;
            break;
        case 3:
            desk = 303;
            break;
        default:
            desk = 404;
    }

    printf("SUPPORT QUEUE\n");
    printf("Proceed to desk %d\n", desk);
    printf("Estimated wait: %d minutes\n", waiting);

    return 0;
}

