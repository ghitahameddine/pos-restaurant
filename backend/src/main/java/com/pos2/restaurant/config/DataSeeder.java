package com.pos2.restaurant.config;

import com.pos2.restaurant.domain.MenuItem;
import com.pos2.restaurant.domain.RestaurantTable;
import com.pos2.restaurant.domain.Slot;
import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.SlotZone;
import com.pos2.restaurant.domain.enums.UserRole;
import com.pos2.restaurant.repository.MenuItemRepository;
import com.pos2.restaurant.repository.RestaurantTableRepository;
import com.pos2.restaurant.repository.SlotRepository;
import com.pos2.restaurant.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.IntStream;

@Component
public class DataSeeder implements CommandLineRunner {

    private final MenuItemRepository menuItemRepository;
    private final RestaurantTableRepository tableRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SlotRepository slotRepository;

    public DataSeeder(
            MenuItemRepository menuItemRepository,
            RestaurantTableRepository tableRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SlotRepository slotRepository
    ) {
        this.menuItemRepository = menuItemRepository;
        this.tableRepository = tableRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.slotRepository = slotRepository;
    }

    @Override
    public void run(String... args) {
        seedTables();
        seedMenu();
        seedWaiter();
        seedSlots();
    }

    private void seedTables() {
        if (tableRepository.count() > 0) {
            return;
        }
        IntStream.rangeClosed(1, 10)
                .mapToObj(RestaurantTable::new)
                .forEach(tableRepository::save);
    }

    private void seedMenu() {
        if (menuItemRepository.count() > 0) {
            return;
        }

        List<MenuItem> items = List.of(
                new MenuItem("Burger Signature", "Burgers", new BigDecimal("45.00"), 8, "Plats", "Pain brioche, steak grille, cheddar, salade croquante et sauce maison.", "Servi avec frites. Cuisson personnalisable sur demande.", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd"),
                new MenuItem("Pizza Margherita", "Pizzas", new BigDecimal("55.00"), 10, "Plats", "Sauce tomate, mozzarella fondante, basilic frais et huile d olive.", "Pate fine cuite minute. Taille individuelle.", "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3"),
                new MenuItem("Jus Orange Frais", "Boissons", new BigDecimal("18.00"), 3, "Boissons", "Orange pressee a la commande, sans sucre ajoute.", "Disponible bien frais. Format 30 cl.", "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b"),
                new MenuItem("Tacos Poulet", "Tacos", new BigDecimal("49.00"), 9, "Plats", "Poulet marine, sauce fromagere, frites et fromage gratine.", "Sauce au choix: douce, barbecue ou piquante.", "https://images.unsplash.com/photo-1565299507177-b0ac66763828"),
                new MenuItem("Salade Cesar", "Salades", new BigDecimal("38.00"), 6, "Plats", "Poulet grille, laitue, parmesan, croutons et sauce cesar.", "Option sans croutons possible.", "https://images.unsplash.com/photo-1550304943-4f24f54ddde9"),
                new MenuItem("Tiramisu", "Desserts", new BigDecimal("30.00"), 5, "Desserts", "Creme mascarpone, cafe doux et cacao.", "Dessert froid prepare chaque matin.", "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9")
        );

        menuItemRepository.saveAll(items);
    }

    private void seedWaiter() {
        String waiterPhone = "0600000000";
        if (userRepository.existsByPhone(waiterPhone)) {
            return;
        }

        User waiter = new User(
                waiterPhone,
                passwordEncoder.encode("1234"),
                "Serveur POS2",
                UserRole.WAITER
        );
        userRepository.save(waiter);
    }

    private void seedSlots() {
        slotRepository.deleteAll(slotRepository.findByNumberGreaterThan(4));

        if (slotRepository.count() > 0) {
            return;
        }

        String[] colors = {"Rouge", "Bleu", "Vert", "Jaune"};
        for (int index = 0; index < colors.length; index++) {
            int number = index + 1;
            slotRepository.save(new Slot(number, colors[index], SlotZone.KITCHEN));
            slotRepository.save(new Slot(number, colors[index], SlotZone.COUNTER));
        }
    }
}
