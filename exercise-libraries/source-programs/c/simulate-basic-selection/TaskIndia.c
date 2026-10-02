/*
@codescope
@title Integer If Else If (2), and Switch
@seed x min=12 max=16
@seed y min=4 max=8
@seed points min=3 max=7
*/
#include <stdio.h>

int main(void)
{
    int x = 14;
    int y = 6;
    int score;
    int category;
    int points = 5;

    score = x + y * 3;

    if (score >= 30) {
        category = 3;
    } else if (score >= 20) {
        category = 2;
    } else {
        category = 1;
    }

    if (category == 3) {
        points = points + 10;
    } else if (category == 2) {
        points = points + 5;
    } else {
        points = points + 2;
    }

    switch (category)
    {
        case 1:
            score = score + points;
            break;

        case 2:
            score = score * 2;
            break;

        case 3:
            score = score - points;
            break;

        default:
            score = 0;
    }

    printf("x = %d\n", x);
    printf("y = %d\n", y);
    printf("score = %d\n", score);
    printf("category = %d\n", category);
    printf("points = %d\n", points);

    return 0;
}