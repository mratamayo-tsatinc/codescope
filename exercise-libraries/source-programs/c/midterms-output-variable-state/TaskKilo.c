/*
@codescope
@title Sequential assignments and formatted output
@seed score min=60 max=85
@seed price min=5.00 max=15.00 decimals=2
@seed letter values='A'|'B'|'C'
*/
#include <stdio.h>

int main() {
    int score = 75;
    float price = 9.5;
    char letter = 'B';

    printf("Initial score: %d\n", score);
    printf("Initial price: %.2f\n", price);
    printf("Initial letter: %c\n", letter);

    score = 90;
    price = price + 2.5;
    letter = 'A';

    printf("Updated score: %d\n", score);
    printf("Updated price: %.2f\n", price);
    printf("Updated letter: %c\n", letter);

    int bonus = score;
    score = bonus + 5;

    printf("Final score: %d\n", score);
    return 0;
}
