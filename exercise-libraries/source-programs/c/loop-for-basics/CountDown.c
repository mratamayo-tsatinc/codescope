/*
@codescope
@title Count down with for
@seed start min=3 max=5
*/
#include <stdio.h>

int main(void) {
    int i;
    int start = 4;

    for (i = start; i > 0; i--) {
        printf("%d\n", i);
    }

    printf("done\n");

    return 0;
}

