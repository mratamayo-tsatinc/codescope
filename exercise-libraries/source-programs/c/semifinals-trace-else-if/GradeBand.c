/*
@codescope
@title Training Assessment
@seed score min=55 max=98
@seed bonus min=0 max=5
*/
#include <stdio.h>

int main(void)
{
    int score = 84;
    int bonus = 3;
    int finalScore;
    int band;

    finalScore = score + bonus;

    if (finalScore >= 90) {
        band = 1;
    } else if (finalScore >= 80) {
        band = 2;
    } else if (finalScore >= 75) {
        band = 3;
    } else {
        band = 4;
    }

    printf("TRAINING ASSESSMENT\n");
    printf("Final score: %d\n", finalScore);
    printf("Performance band: %d\n", band);

    return 0;
}

