/*
@codescope
@title Integer and Multiple Simple Ifs
@seed score min=66 max=70
@seed points min=8 max=12
@seed level min=1 max=4
*/
#include <stdio.h>

int main(void)
{
    int score = 68;
    int points = 10;
    int level = 2;

    if (score >= 60)
    {
        points = points + 5;
    }

    if (score >= 70)
    {
        points = points + 10;
        level = level + 1;
    }

    if (points > 12)
    {
        score = score + 4;
    }

    printf("score = %d\n", score);
    printf("points = %d\n", points);
    printf("level = %d\n", level);

    return 0;
}
