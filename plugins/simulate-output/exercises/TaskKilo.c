/*
@output
Initial score: 75
Initial price: 9.50
Initial letter: B
Updated score: 90
Updated price: 12.00
Updated letter: A
Final score: 95

@variables
score = 95
price = 12.00
letter = A
bonus = 90
*/
#include <stdio.h>

int main() {
    int score;
    float price;
    char letter;

    score = 75;
    price = 9.5;
    letter = 'B';

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