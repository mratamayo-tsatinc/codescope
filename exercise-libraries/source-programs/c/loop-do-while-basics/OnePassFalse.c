/*
@codescope
@title See the false test after one pass
@seed score min=7 max=9
@seed target min=4 max=6
*/
#include <stdio.h>

int main(void) {
    int score = 8;
    int target = 5;

    printf("ONE PASS EVEN WHEN FALSE\n\n");

    do {
        printf("BODY EXECUTED\n");
        score++;
    } while (score < target);

    printf("\nFINAL SCORE: %d\n", score);

    return 0;
}

