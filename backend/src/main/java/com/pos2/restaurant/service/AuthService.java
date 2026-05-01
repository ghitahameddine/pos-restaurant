package com.pos2.restaurant.service;

import com.pos2.restaurant.domain.User;
import com.pos2.restaurant.domain.enums.UserRole;
import com.pos2.restaurant.dto.auth.AuthResponse;
import com.pos2.restaurant.dto.auth.ForgotPasswordRequest;
import com.pos2.restaurant.dto.auth.LoginRequest;
import com.pos2.restaurant.dto.auth.RegisterRequest;
import com.pos2.restaurant.dto.auth.ResetPasswordRequest;
import com.pos2.restaurant.exception.BadRequestException;
import com.pos2.restaurant.exception.ResourceNotFoundException;
import com.pos2.restaurant.repository.UserRepository;
import com.pos2.restaurant.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String SIMULATED_OTP = "1234";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse registerClient(RegisterRequest request) {
        verifyOtp(request.otp());
        if (userRepository.existsByPhone(request.phone())) {
            throw new BadRequestException("Ce numero de telephone existe deja.");
        }

        User user = new User(
                request.phone(),
                passwordEncoder.encode(request.password()),
                request.name(),
                UserRole.CLIENT
        );

        return toAuthResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByPhone(request.phone())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadRequestException("Mot de passe incorrect.");
        }

        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public String forgotPassword(ForgotPasswordRequest request) {
        if (!userRepository.existsByPhone(request.phone())) {
            throw new ResourceNotFoundException("Utilisateur introuvable.");
        }
        return "Code envoye : " + SIMULATED_OTP;
    }

    @Transactional
    public String resetPassword(ResetPasswordRequest request) {
        verifyOtp(request.otp());
        User user = userRepository.findByPhone(request.phone())
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable."));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return "Mot de passe modifie avec succes.";
    }

    public String generateJwt(User user) {
        return jwtService.generateToken(user);
    }

    private AuthResponse toAuthResponse(User user) {
        return new AuthResponse(
                generateJwt(user),
                user.getId(),
                user.getPhone(),
                user.getName(),
                user.getRole(),
                user.getPoints()
        );
    }

    private void verifyOtp(String otp) {
        if (!SIMULATED_OTP.equals(otp)) {
            throw new BadRequestException("Code OTP incorrect.");
        }
    }
}

