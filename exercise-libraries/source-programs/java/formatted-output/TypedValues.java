/*
@codescope
@title Typed Values and Reassignment
@result score
*/
public class TypedValues {
    public static void main(String[] args) {
        int score;
        float price;
        char letter;

        score = 75;
        price = 9.5f;
        letter = 'B';

        System.out.println("Initial score: " + score);
        System.out.println("Initial price: " + price);
        System.out.println("Initial letter: " + letter);

        score = 90;
        price = price + 2.5f;
        letter = 'A';

        System.out.println("Updated score: " + score);
        System.out.println("Updated price: " + price);
        System.out.println("Updated letter: " + letter);

        int bonus = score;
        score = bonus + 5;

        System.out.println("Final score: " + score);
    }
}
